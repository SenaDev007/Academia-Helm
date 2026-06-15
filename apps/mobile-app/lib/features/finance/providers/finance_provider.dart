/// ============================================================================
/// FINANCE PROVIDER — Academia Hub Mobile
/// ============================================================================
///
/// Riverpod providers for the Finance module.
/// Uses [FinanceService] for CRUD operations and returns [AsyncValue] states
/// that integrate seamlessly with [AsyncValueWidget] and [ModuleLoadingWrapper].
///
/// Providers:
/// - financeServiceProvider              → Singleton for [FinanceService]
/// - feeStructuresProvider               → List of fee structures
/// - expensesProvider                    → List of expenses
/// - transactionsProvider                → List of transactions
/// - studentAccountsProvider             → List of student accounts
/// - financeSettingsProvider             → Finance settings (detail)
/// - treasuryClosuresProvider            → List, family by academicYearId
/// - recoveryRemindersProvider           → List, family by academicYearId
/// - kpiReportsProvider                  → KPI reports (detail)
/// - financeAnomaliesProvider            → List of anomalies
/// - financeAuditLogsProvider            → List of audit logs
/// - feeRegimesProvider                  → List of fee regimes
/// - expenseCategoriesProvider           → List of expense categories
/// - arrearsProvider                     → List of arrears
/// - classEncaissementsProvider          → List of class encaissements
/// - monthlyEncaissementsProvider        → List of monthly encaissements
/// - expenseByCategoryProvider           → List of expenses by category
/// - studentAccountDetailProvider        → Family by id
/// - expenseBudgetsProvider              → Family by academicYearId
/// - FinanceMutationNotifier             → create/update/delete mutations
///
/// Usage with ModuleLoadingWrapper:
/// ```dart
/// class FeeStructuresScreen extends ConsumerWidget {
///   @override
///   Widget build(BuildContext context, WidgetRef ref) {
///     final feeStructuresAsync = ref.watch(feeStructuresProvider);
///
///     return ModuleLoadingWrapper<List<Map<String, dynamic>>>(
///       value: feeStructuresAsync,
///       moduleName: 'Structures de frais',
///       onRetry: () => ref.invalidate(feeStructuresProvider),
///       builder: (items) => FeeStructuresList(items: items),
///     );
///   }
/// }
/// ```
/// ============================================================================

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_result.dart';
import '../../../data/services/finance_service.dart';

// ─── Service Provider ────────────────────────────────────────────────────────

/// Singleton provider for [FinanceService].
final financeServiceProvider = Provider<FinanceService>((ref) {
  return FinanceService();
});

// ─── Fee Structures Provider ─────────────────────────────────────────────────

/// Fetches the list of fee structures.
final feeStructuresProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final service = ref.read(financeServiceProvider);
  final result = await service.getFeeStructures();

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => [],
  );
});

// ─── Fee Regimes Provider ────────────────────────────────────────────────────

/// Fetches the list of fee regimes.
final feeRegimesProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final service = ref.read(financeServiceProvider);
  final result = await service.getFeeRegimes();

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => [],
  );
});

// ─── Expenses Provider ───────────────────────────────────────────────────────

/// Fetches the list of expenses.
final expensesProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final service = ref.read(financeServiceProvider);
  final result = await service.getExpenses();

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => [],
  );
});

// ─── Expense Categories Provider ─────────────────────────────────────────────

/// Fetches the list of expense categories.
final expenseCategoriesProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final service = ref.read(financeServiceProvider);
  final result = await service.getExpenseCategories();

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => [],
  );
});

// ─── Expense Budgets Provider ────────────────────────────────────────────────

/// Fetches expense budgets for a given academic year.
///
/// Usage:
/// ```dart
/// final budgetsAsync = ref.watch(expenseBudgetsProvider(academicYearId));
/// ```
final expenseBudgetsProvider =
    FutureProvider.family<Map<String, dynamic>, String>((ref, academicYearId) async {
  final service = ref.read(financeServiceProvider);
  final result = await service.getExpenseBudgets(academicYearId);

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => <String, dynamic>{},
  );
});

// ─── Transactions Provider ───────────────────────────────────────────────────

/// Fetches the list of transactions.
final transactionsProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final service = ref.read(financeServiceProvider);
  final result = await service.getTransactions();

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => [],
  );
});

// ─── Student Accounts Provider ───────────────────────────────────────────────

/// Fetches the list of student accounts.
final studentAccountsProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final service = ref.read(financeServiceProvider);
  final result = await service.getStudentAccounts();

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => [],
  );
});

// ─── Student Account Detail Provider ─────────────────────────────────────────

/// Fetches details for a single student account.
///
/// Usage:
/// ```dart
/// final accountAsync = ref.watch(studentAccountDetailProvider(accountId));
/// ```
final studentAccountDetailProvider =
    FutureProvider.family<Map<String, dynamic>, String>((ref, id) async {
  final service = ref.read(financeServiceProvider);
  final result = await service.getStudentAccountDetails(id);

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => <String, dynamic>{},
  );
});

// ─── Finance Settings Provider ───────────────────────────────────────────────

/// Fetches finance settings.
final financeSettingsProvider =
    FutureProvider<Map<String, dynamic>>((ref) async {
  final service = ref.read(financeServiceProvider);
  final result = await service.getSettings();

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => <String, dynamic>{},
  );
});

// ─── Treasury Closures Provider ──────────────────────────────────────────────

/// Fetches treasury closures for a given academic year.
///
/// Usage:
/// ```dart
/// final closuresAsync = ref.watch(treasuryClosuresProvider(academicYearId));
/// ```
final treasuryClosuresProvider =
    FutureProvider.family<List<Map<String, dynamic>>, String>(
        (ref, academicYearId) async {
  final service = ref.read(financeServiceProvider);
  final result = await service.getTreasuryClosures(academicYearId);

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => [],
  );
});

// ─── Recovery Reminders Provider ─────────────────────────────────────────────

/// Fetches recovery reminders for a given academic year.
///
/// Usage:
/// ```dart
/// final remindersAsync = ref.watch(recoveryRemindersProvider(academicYearId));
/// ```
final recoveryRemindersProvider =
    FutureProvider.family<List<Map<String, dynamic>>, String>(
        (ref, academicYearId) async {
  final service = ref.read(financeServiceProvider);
  final result = await service.getRecoveryReminders(academicYearId);

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => [],
  );
});

// ─── KPI Reports Provider ────────────────────────────────────────────────────

/// Fetches KPI reports for finance.
final kpiReportsProvider =
    FutureProvider<Map<String, dynamic>>((ref) async {
  final service = ref.read(financeServiceProvider);
  final result = await service.getKpiReports();

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => <String, dynamic>{},
  );
});

// ─── Arrears Provider ────────────────────────────────────────────────────────

/// Fetches the list of arrears.
final arrearsProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final service = ref.read(financeServiceProvider);
  final result = await service.getArrears();

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => [],
  );
});

// ─── Class Encaissements Provider ────────────────────────────────────────────

/// Fetches class encaissements.
final classEncaissementsProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final service = ref.read(financeServiceProvider);
  final result = await service.getClassEncaissements();

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => [],
  );
});

// ─── Monthly Encaissements Provider ──────────────────────────────────────────

/// Fetches monthly encaissements.
final monthlyEncaissementsProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final service = ref.read(financeServiceProvider);
  final result = await service.getMonthlyEncaissements();

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => [],
  );
});

// ─── Expense By Category Provider ────────────────────────────────────────────

/// Fetches expenses by category.
final expenseByCategoryProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final service = ref.read(financeServiceProvider);
  final result = await service.getExpenseByCategory();

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => [],
  );
});

// ─── Finance Anomalies Provider ──────────────────────────────────────────────

/// Fetches the list of finance anomalies.
final financeAnomaliesProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final service = ref.read(financeServiceProvider);
  final result = await service.getAnomalies();

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => [],
  );
});

// ─── Finance Audit Logs Provider ─────────────────────────────────────────────

/// Fetches the list of finance audit logs.
final financeAuditLogsProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final service = ref.read(financeServiceProvider);
  final result = await service.getAuditLogs();

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => [],
  );
});

// ─── Mutation Notifier ───────────────────────────────────────────────────────

/// Notifier for finance CRUD mutations that automatically invalidates
/// relevant providers on success.
class FinanceMutationNotifier extends StateNotifier<AsyncValue<void>> {
  final Ref _ref;
  final FinanceService _service;

  FinanceMutationNotifier(this._ref, this._service)
      : super(const AsyncValue.data(null));

  /// Creates a fee structure and refreshes the list.
  Future<bool> createFeeStructure(Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.createFeeStructure(data);
      return result.when(
        success: (_) {
          _ref.invalidate(feeStructuresProvider);
          state = const AsyncValue.data(null);
          return true;
        },
        failure: (error) {
          state = AsyncValue.error(
              Exception(error.displayMessage), StackTrace.current);
          return false;
        },
        loading: () => false,
      );
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }

  /// Updates a fee structure and refreshes the list.
  Future<bool> updateFeeStructure(String id, Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.updateFeeStructure(id, data);
      return result.when(
        success: (_) {
          _ref.invalidate(feeStructuresProvider);
          state = const AsyncValue.data(null);
          return true;
        },
        failure: (error) {
          state = AsyncValue.error(
              Exception(error.displayMessage), StackTrace.current);
          return false;
        },
        loading: () => false,
      );
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }

  /// Deletes a fee structure and refreshes the list.
  Future<bool> deleteFeeStructure(String id) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.deleteFeeStructure(id);
      return result.when(
        success: (_) {
          _ref.invalidate(feeStructuresProvider);
          state = const AsyncValue.data(null);
          return true;
        },
        failure: (error) {
          state = AsyncValue.error(
              Exception(error.displayMessage), StackTrace.current);
          return false;
        },
        loading: () => false,
      );
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }

  /// Creates an expense and refreshes the list.
  Future<bool> createExpense(Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.createExpense(data);
      return result.when(
        success: (_) {
          _ref.invalidate(expensesProvider);
          state = const AsyncValue.data(null);
          return true;
        },
        failure: (error) {
          state = AsyncValue.error(
              Exception(error.displayMessage), StackTrace.current);
          return false;
        },
        loading: () => false,
      );
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }

  /// Approves an expense and refreshes the list.
  Future<bool> approveExpense(String id) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.approveExpense(id);
      return result.when(
        success: (_) {
          _ref.invalidate(expensesProvider);
          state = const AsyncValue.data(null);
          return true;
        },
        failure: (error) {
          state = AsyncValue.error(
              Exception(error.displayMessage), StackTrace.current);
          return false;
        },
        loading: () => false,
      );
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }

  /// Rejects an expense and refreshes the list.
  Future<bool> rejectExpense(String id) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.rejectExpense(id);
      return result.when(
        success: (_) {
          _ref.invalidate(expensesProvider);
          state = const AsyncValue.data(null);
          return true;
        },
        failure: (error) {
          state = AsyncValue.error(
              Exception(error.displayMessage), StackTrace.current);
          return false;
        },
        loading: () => false,
      );
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }

  /// Creates a transaction and refreshes the list.
  Future<bool> createTransaction(Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.createTransaction(data);
      return result.when(
        success: (_) {
          _ref.invalidate(transactionsProvider);
          _ref.invalidate(studentAccountsProvider);
          state = const AsyncValue.data(null);
          return true;
        },
        failure: (error) {
          state = AsyncValue.error(
              Exception(error.displayMessage), StackTrace.current);
          return false;
        },
        loading: () => false,
      );
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }

  /// Records a payment (alias for createTransaction) and refreshes lists.
  Future<bool> recordPayment(Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.recordPayment(data);
      return result.when(
        success: (_) {
          _ref.invalidate(transactionsProvider);
          _ref.invalidate(studentAccountsProvider);
          state = const AsyncValue.data(null);
          return true;
        },
        failure: (error) {
          state = AsyncValue.error(
              Exception(error.displayMessage), StackTrace.current);
          return false;
        },
        loading: () => false,
      );
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }

  /// Updates finance settings and refreshes the settings provider.
  Future<bool> updateFinanceSettings(Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.updateSettings(data);
      return result.when(
        success: (_) {
          _ref.invalidate(financeSettingsProvider);
          state = const AsyncValue.data(null);
          return true;
        },
        failure: (error) {
          state = AsyncValue.error(
              Exception(error.displayMessage), StackTrace.current);
          return false;
        },
        loading: () => false,
      );
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }

  /// Creates a treasury closure and refreshes the list.
  Future<bool> createTreasuryClosure(Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.createTreasuryClosure(data);
      return result.when(
        success: (_) {
          // Invalidate all family instances since we don't know the year
          state = const AsyncValue.data(null);
          return true;
        },
        failure: (error) {
          state = AsyncValue.error(
              Exception(error.displayMessage), StackTrace.current);
          return false;
        },
        loading: () => false,
      );
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }

  /// Validates a treasury closure.
  Future<bool> validateTreasuryClosure(String id) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.validateTreasuryClosure(id);
      return result.when(
        success: (_) {
          state = const AsyncValue.data(null);
          return true;
        },
        failure: (error) {
          state = AsyncValue.error(
              Exception(error.displayMessage), StackTrace.current);
          return false;
        },
        loading: () => false,
      );
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }

  /// Creates a student fee profile.
  Future<bool> createStudentFeeProfile(Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.createStudentFeeProfile(data);
      return result.when(
        success: (_) {
          _ref.invalidate(studentAccountsProvider);
          state = const AsyncValue.data(null);
          return true;
        },
        failure: (error) {
          state = AsyncValue.error(
              Exception(error.displayMessage), StackTrace.current);
          return false;
        },
        loading: () => false,
      );
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }

  /// Unblocks a student account.
  Future<bool> unblockStudentAccount(
      String id, Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.unblockStudentAccount(id, data);
      return result.when(
        success: (_) {
          _ref.invalidate(studentAccountsProvider);
          _ref.invalidate(studentAccountDetailProvider(id));
          state = const AsyncValue.data(null);
          return true;
        },
        failure: (error) {
          state = AsyncValue.error(
              Exception(error.displayMessage), StackTrace.current);
          return false;
        },
        loading: () => false,
      );
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }

  /// Sends a manual recovery reminder.
  Future<bool> sendManualRecoveryReminder(Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.sendManualRecoveryReminder(data);
      return result.when(
        success: (_) {
          state = const AsyncValue.data(null);
          return true;
        },
        failure: (error) {
          state = AsyncValue.error(
              Exception(error.displayMessage), StackTrace.current);
          return false;
        },
        loading: () => false,
      );
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }

  /// Copies fee structures to another year.
  Future<bool> copyFeeStructuresToYear(Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.copyFeeStructuresToYear(data);
      return result.when(
        success: (_) {
          _ref.invalidate(feeStructuresProvider);
          state = const AsyncValue.data(null);
          return true;
        },
        failure: (error) {
          state = AsyncValue.error(
              Exception(error.displayMessage), StackTrace.current);
          return false;
        },
        loading: () => false,
      );
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }

  /// Overrides a fee structure.
  Future<bool> overrideFeeStructure(Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.overrideFeeStructure(data);
      return result.when(
        success: (_) {
          _ref.invalidate(feeStructuresProvider);
          state = const AsyncValue.data(null);
          return true;
        },
        failure: (error) {
          state = AsyncValue.error(
              Exception(error.displayMessage), StackTrace.current);
          return false;
        },
        loading: () => false,
      );
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }
}

/// Provider for finance mutation operations.
final financeMutationProvider =
    StateNotifierProvider<FinanceMutationNotifier, AsyncValue<void>>((ref) {
  final service = ref.read(financeServiceProvider);
  return FinanceMutationNotifier(ref, service);
});
