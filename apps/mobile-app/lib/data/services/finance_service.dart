/// ============================================================================
/// FINANCE SERVICE — Academia Hub Mobile
/// ============================================================================
///
/// Service CRUD pour le module Finance.
/// Miroir de finance.service.ts du web app.
///
/// Méthodes :
/// - getFeeStructures, createFeeStructure, updateFeeStructure,
///   deleteFeeStructure (Structures de frais)
/// - getExpenses, createExpense, approveExpense, rejectExpense (Dépenses)
/// - getTransactions, createTransaction (Transactions)
/// - getStudentAccounts, getStudentAccountDetails, unblockStudentAccount
///   (Comptes élèves)
/// - getSettings, updateSettings (Paramètres)
/// - getTreasuryClosures, createTreasuryClosure, validateTreasuryClosure
///   (Trésorerie)
/// - getKpiReports, getArrears, exportReports (Rapports)
/// - getAnomalies, getAuditLogs (Audit)
/// - getRecoveryReminders, sendManualRecoveryReminder (Relances)
/// ============================================================================

import '../../core/crud/base_crud_service.dart';
import '../../core/network/api_config.dart';
import '../../core/network/api_result.dart';
import '../../core/network/api_client.dart';
import '../../core/offline/offline_service.dart';

class FinanceService extends BaseCrudService {
  FinanceService()
      : super(
          endpoint: ApiConfig.finance,
          collection: 'finance',
          entityType: SyncEntityType.payment,
        );

  // ─── Régimes de frais ────────────────────────────────────────────────────

  /// Récupère la liste des régimes de frais.
  Future<ApiResult<List<Map<String, dynamic>>>> getFeeRegimes({
    Map<String, dynamic>? params,
  }) async {
    try {
      final result = await ApiClient.instance.getRaw(
        ApiConfig.financeFeeRegimes,
        queryParameters: params,
      );
      return result.when(
        success: (data) {
          if (data.containsKey('data') && data['data'] is List) {
            return ApiSuccess(
              (data['data'] as List)
                  .map((e) => e as Map<String, dynamic>)
                  .toList(),
            );
          }
          return ApiSuccess([data]);
        },
        failure: (error) => ApiFailure(error),
        loading: () => const ApiResult.loading(),
      );
    } catch (e) {
      return ApiFailure(ApiError.fromDioException(e));
    }
  }

  /// Crée un profil de frais pour un élève.
  Future<ApiResult<Map<String, dynamic>>> createStudentFeeProfile(
    Map<String, dynamic> data,
  ) async {
    return ApiClient.instance.postRaw(
      ApiConfig.financeStudentFeeProfiles,
      data: data,
    );
  }

  // ─── Structures de frais ─────────────────────────────────────────────────

  /// Récupère la liste des structures de frais.
  Future<ApiResult<List<Map<String, dynamic>>>> getFeeStructures({
    Map<String, dynamic>? params,
  }) async {
    return apiGetWithFallback(
      ApiConfig.financeFeeStructures,
      params: params,
      localCollection: 'fee_structures',
    );
  }

  /// Crée une structure de frais.
  Future<ApiResult<Map<String, dynamic>>> createFeeStructure(
    Map<String, dynamic> data,
  ) async {
    return apiPostWithOfflineFallback(
      ApiConfig.financeFeeStructures,
      data,
      offlineEntityType: SyncEntityType.feeStructure,
    );
  }

  /// Met à jour une structure de frais.
  Future<ApiResult<Map<String, dynamic>>> updateFeeStructure(
    String id,
    Map<String, dynamic> data,
  ) async {
    return apiUpdateWithOfflineFallback(
      ApiConfig.financeFeeStructureById(id),
      id,
      data,
      offlineEntityType: SyncEntityType.feeStructure,
    );
  }

  /// Supprime une structure de frais.
  Future<ApiResult<void>> deleteFeeStructure(String id) async {
    return apiDeleteWithOfflineFallback(
      ApiConfig.financeFeeStructureById(id),
      id,
      offlineEntityType: SyncEntityType.feeStructure,
    );
  }

  /// Copie les structures de frais vers une autre année.
  Future<ApiResult<Map<String, dynamic>>> copyFeeStructuresToYear(
    Map<String, dynamic> data,
  ) async {
    return ApiClient.instance.postRaw(
      ApiConfig.financeFeeStructuresCopyToYear,
      data: data,
    );
  }

  /// Surcharge une structure de frais.
  Future<ApiResult<Map<String, dynamic>>> overrideFeeStructure(
    Map<String, dynamic> data,
  ) async {
    return ApiClient.instance.postRaw(
      ApiConfig.financeFeeStructuresOverride,
      data: data,
    );
  }

  // ─── Dépenses ────────────────────────────────────────────────────────────

  /// Récupère la liste des dépenses.
  Future<ApiResult<List<Map<String, dynamic>>>> getExpenses({
    Map<String, dynamic>? params,
  }) async {
    return apiGetWithFallback(
      ApiConfig.financeExpenses,
      params: params,
      localCollection: 'expenses',
    );
  }

  /// Récupère les budgets des dépenses.
  Future<ApiResult<Map<String, dynamic>>> getExpenseBudgets(
    String academicYearId,
  ) async {
    return ApiClient.instance.getRaw(
      ApiConfig.financeExpenseBudgets(academicYearId),
    );
  }

  /// Récupère les catégories de dépenses.
  Future<ApiResult<List<Map<String, dynamic>>>> getExpenseCategories() async {
    try {
      final result = await ApiClient.instance.getRaw(
        ApiConfig.financeExpenseCategories,
      );
      return result.when(
        success: (data) {
          if (data.containsKey('data') && data['data'] is List) {
            return ApiSuccess(
              (data['data'] as List)
                  .map((e) => e as Map<String, dynamic>)
                  .toList(),
            );
          }
          return ApiSuccess([data]);
        },
        failure: (error) => ApiFailure(error),
        loading: () => const ApiResult.loading(),
      );
    } catch (e) {
      return ApiFailure(ApiError.fromDioException(e));
    }
  }

  /// Crée une dépense.
  Future<ApiResult<Map<String, dynamic>>> createExpense(
    Map<String, dynamic> data,
  ) async {
    return apiPostWithOfflineFallback(
      ApiConfig.financeExpenses,
      data,
      offlineEntityType: SyncEntityType.expense,
    );
  }

  /// Approuve une dépense.
  Future<ApiResult<Map<String, dynamic>>> approveExpense(String id) async {
    return ApiClient.instance.patch(
      ApiConfig.financeExpenseApprove(id),
      fromJson: (json) => json,
    );
  }

  /// Rejette une dépense.
  Future<ApiResult<Map<String, dynamic>>> rejectExpense(String id) async {
    return ApiClient.instance.patch(
      ApiConfig.financeExpenseReject(id),
      fromJson: (json) => json,
    );
  }

  // ─── Paramètres ──────────────────────────────────────────────────────────

  /// Récupère les paramètres finance.
  Future<ApiResult<Map<String, dynamic>>> getSettings() async {
    return ApiClient.instance.getRaw(
      ApiConfig.financeSettings,
    );
  }

  /// Met à jour les paramètres finance.
  Future<ApiResult<Map<String, dynamic>>> updateSettings(
    Map<String, dynamic> data,
  ) async {
    return apiUpdateWithOfflineFallback(
      ApiConfig.financeSettings,
      'settings',
      data,
      offlineEntityType: SyncEntityType.financeSetting,
    );
  }

  // ─── Trésorerie ─────────────────────────────────────────────────────────

  /// Récupère les clôtures de trésorerie.
  Future<ApiResult<List<Map<String, dynamic>>>> getTreasuryClosures(
    String academicYearId,
  ) async {
    try {
      final result = await ApiClient.instance.getRaw(
        ApiConfig.financeTreasuryClosures,
        queryParameters: {'academicYearId': academicYearId},
      );
      return result.when(
        success: (data) {
          if (data.containsKey('data') && data['data'] is List) {
            return ApiSuccess(
              (data['data'] as List)
                  .map((e) => e as Map<String, dynamic>)
                  .toList(),
            );
          }
          return ApiSuccess([data]);
        },
        failure: (error) => ApiFailure(error),
        loading: () => const ApiResult.loading(),
      );
    } catch (e) {
      return ApiFailure(ApiError.fromDioException(e));
    }
  }

  /// Crée une clôture de trésorerie.
  Future<ApiResult<Map<String, dynamic>>> createTreasuryClosure(
    Map<String, dynamic> data,
  ) async {
    return ApiClient.instance.postRaw(
      ApiConfig.financeTreasuryClosures,
      data: data,
    );
  }

  /// Valide une clôture de trésorerie.
  Future<ApiResult<Map<String, dynamic>>> validateTreasuryClosure(
    String id,
  ) async {
    return ApiClient.instance.patch(
      ApiConfig.financeTreasuryClosureValidate(id),
      fromJson: (json) => json,
    );
  }

  // ─── Comptes élèves ─────────────────────────────────────────────────────

  /// Récupère la liste des comptes élèves.
  Future<ApiResult<List<Map<String, dynamic>>>> getStudentAccounts({
    Map<String, dynamic>? params,
  }) async {
    try {
      final result = await ApiClient.instance.getRaw(
        ApiConfig.financeStudentAccounts,
        queryParameters: params,
      );
      return result.when(
        success: (data) {
          if (data.containsKey('data') && data['data'] is List) {
            return ApiSuccess(
              (data['data'] as List)
                  .map((e) => e as Map<String, dynamic>)
                  .toList(),
            );
          }
          return ApiSuccess([data]);
        },
        failure: (error) => ApiFailure(error),
        loading: () => const ApiResult.loading(),
      );
    } catch (e) {
      return ApiFailure(ApiError.fromDioException(e));
    }
  }

  /// Récupère les détails d'un compte élève.
  Future<ApiResult<Map<String, dynamic>>> getStudentAccountDetails(
    String id,
  ) async {
    return ApiClient.instance.getRaw(
      ApiConfig.financeStudentAccountById(id),
    );
  }

  /// Débloque un compte élève.
  Future<ApiResult<Map<String, dynamic>>> unblockStudentAccount(
    String id,
    Map<String, dynamic> data,
  ) async {
    return ApiClient.instance.postRaw(
      ApiConfig.financeStudentAccountUnblock(id),
      data: data,
    );
  }

  // ─── Transactions ────────────────────────────────────────────────────────

  /// Récupère la liste des transactions.
  Future<ApiResult<List<Map<String, dynamic>>>> getTransactions({
    Map<String, dynamic>? params,
  }) async {
    try {
      final result = await ApiClient.instance.getRaw(
        ApiConfig.financeTransactions,
        queryParameters: params,
      );
      return result.when(
        success: (data) {
          if (data.containsKey('data') && data['data'] is List) {
            return ApiSuccess(
              (data['data'] as List)
                  .map((e) => e as Map<String, dynamic>)
                  .toList(),
            );
          }
          return ApiSuccess([data]);
        },
        failure: (error) => ApiFailure(error),
        loading: () => const ApiResult.loading(),
      );
    } catch (e) {
      return ApiFailure(ApiError.fromDioException(e));
    }
  }

  /// Crée une transaction (paiement).
  Future<ApiResult<Map<String, dynamic>>> createTransaction(
    Map<String, dynamic> data,
  ) async {
    return apiPostWithOfflineFallback(
      ApiConfig.financeTransactions,
      data,
      offlineEntityType: SyncEntityType.payment,
    );
  }

  /// Alias pour createTransaction — enregistre un paiement.
  Future<ApiResult<Map<String, dynamic>>> recordPayment(
    Map<String, dynamic> data,
  ) async {
    return createTransaction(data);
  }

  /// Alias pour createTransaction — crée un paiement.
  Future<ApiResult<Map<String, dynamic>>> createPayment(
    Map<String, dynamic> data,
  ) async {
    return createTransaction(data);
  }

  // ─── Relances ────────────────────────────────────────────────────────────

  /// Récupère les rappels de recouvrement.
  Future<ApiResult<List<Map<String, dynamic>>>> getRecoveryReminders(
    String academicYearId,
  ) async {
    try {
      final result = await ApiClient.instance.getRaw(
        ApiConfig.financeRecoveryReminders(academicYearId),
      );
      return result.when(
        success: (data) {
          if (data.containsKey('data') && data['data'] is List) {
            return ApiSuccess(
              (data['data'] as List)
                  .map((e) => e as Map<String, dynamic>)
                  .toList(),
            );
          }
          return ApiSuccess([data]);
        },
        failure: (error) => ApiFailure(error),
        loading: () => const ApiResult.loading(),
      );
    } catch (e) {
      return ApiFailure(ApiError.fromDioException(e));
    }
  }

  /// Envoie un rappel manuel de recouvrement.
  Future<ApiResult<Map<String, dynamic>>> sendManualRecoveryReminder(
    Map<String, dynamic> data,
  ) async {
    return ApiClient.instance.postRaw(
      ApiConfig.financeRecoveryRemindersManual,
      data: data,
    );
  }

  /// Lance les rappels nocturnes de recouvrement.
  Future<ApiResult<Map<String, dynamic>>> runNightlyRecoveryReminders(
    Map<String, dynamic> data,
  ) async {
    return ApiClient.instance.postRaw(
      ApiConfig.financeRecoveryRemindersNightly,
      data: data,
    );
  }

  // ─── Rapports & Tableaux de bord ─────────────────────────────────────────

  /// Rapports KPI.
  Future<ApiResult<Map<String, dynamic>>> getKpiReports({
    Map<String, dynamic>? params,
  }) async {
    return ApiClient.instance.getRaw(
      ApiConfig.financeKpiReports,
      queryParameters: params,
    );
  }

  /// Encaissements par classe.
  Future<ApiResult<List<Map<String, dynamic>>>> getClassEncaissements({
    Map<String, dynamic>? params,
  }) async {
    try {
      final result = await ApiClient.instance.getRaw(
        ApiConfig.financeClassEncaissements,
        queryParameters: params,
      );
      return result.when(
        success: (data) {
          if (data.containsKey('data') && data['data'] is List) {
            return ApiSuccess(
              (data['data'] as List)
                  .map((e) => e as Map<String, dynamic>)
                  .toList(),
            );
          }
          return ApiSuccess([data]);
        },
        failure: (error) => ApiFailure(error),
        loading: () => const ApiResult.loading(),
      );
    } catch (e) {
      return ApiFailure(ApiError.fromDioException(e));
    }
  }

  /// Dépenses par catégorie.
  Future<ApiResult<List<Map<String, dynamic>>>> getExpenseByCategory({
    Map<String, dynamic>? params,
  }) async {
    try {
      final result = await ApiClient.instance.getRaw(
        ApiConfig.financeExpenseByCategory,
        queryParameters: params,
      );
      return result.when(
        success: (data) {
          if (data.containsKey('data') && data['data'] is List) {
            return ApiSuccess(
              (data['data'] as List)
                  .map((e) => e as Map<String, dynamic>)
                  .toList(),
            );
          }
          return ApiSuccess([data]);
        },
        failure: (error) => ApiFailure(error),
        loading: () => const ApiResult.loading(),
      );
    } catch (e) {
      return ApiFailure(ApiError.fromDioException(e));
    }
  }

  /// Encaissements mensuels.
  Future<ApiResult<List<Map<String, dynamic>>>> getMonthlyEncaissements({
    Map<String, dynamic>? params,
  }) async {
    try {
      final result = await ApiClient.instance.getRaw(
        ApiConfig.financeMonthlyEncaissements,
        queryParameters: params,
      );
      return result.when(
        success: (data) {
          if (data.containsKey('data') && data['data'] is List) {
            return ApiSuccess(
              (data['data'] as List)
                  .map((e) => e as Map<String, dynamic>)
                  .toList(),
            );
          }
          return ApiSuccess([data]);
        },
        failure: (error) => ApiFailure(error),
        loading: () => const ApiResult.loading(),
      );
    } catch (e) {
      return ApiFailure(ApiError.fromDioException(e));
    }
  }

  /// Arrérages.
  Future<ApiResult<List<Map<String, dynamic>>>> getArrears({
    Map<String, dynamic>? params,
  }) async {
    try {
      final result = await ApiClient.instance.getRaw(
        ApiConfig.financeArrears,
        queryParameters: params,
      );
      return result.when(
        success: (data) {
          if (data.containsKey('data') && data['data'] is List) {
            return ApiSuccess(
              (data['data'] as List)
                  .map((e) => e as Map<String, dynamic>)
                  .toList(),
            );
          }
          return ApiSuccess([data]);
        },
        failure: (error) => ApiFailure(error),
        loading: () => const ApiResult.loading(),
      );
    } catch (e) {
      return ApiFailure(ApiError.fromDioException(e));
    }
  }

  /// Exporte les rapports.
  Future<ApiResult<Map<String, dynamic>>> exportReports(
    Map<String, dynamic> data,
  ) async {
    return ApiClient.instance.postRaw(
      ApiConfig.financeExportReports,
      data: data,
    );
  }

  // ─── Audit ───────────────────────────────────────────────────────────────

  /// Récupère les anomalies financières.
  Future<ApiResult<List<Map<String, dynamic>>>> getAnomalies({
    int limit = 30,
  }) async {
    try {
      final result = await ApiClient.instance.getRaw(
        ApiConfig.financeAnomalies(limit: limit),
      );
      return result.when(
        success: (data) {
          if (data.containsKey('data') && data['data'] is List) {
            return ApiSuccess(
              (data['data'] as List)
                  .map((e) => e as Map<String, dynamic>)
                  .toList(),
            );
          }
          return ApiSuccess([data]);
        },
        failure: (error) => ApiFailure(error),
        loading: () => const ApiResult.loading(),
      );
    } catch (e) {
      return ApiFailure(ApiError.fromDioException(e));
    }
  }

  /// Récupère les journaux d'audit.
  Future<ApiResult<List<Map<String, dynamic>>>> getAuditLogs({
    int limit = 30,
  }) async {
    try {
      final result = await ApiClient.instance.getRaw(
        ApiConfig.financeAuditLogs(limit: limit),
      );
      return result.when(
        success: (data) {
          if (data.containsKey('data') && data['data'] is List) {
            return ApiSuccess(
              (data['data'] as List)
                  .map((e) => e as Map<String, dynamic>)
                  .toList(),
            );
          }
          return ApiSuccess([data]);
        },
        failure: (error) => ApiFailure(error),
        loading: () => const ApiResult.loading(),
      );
    } catch (e) {
      return ApiFailure(ApiError.fromDioException(e));
    }
  }
}
