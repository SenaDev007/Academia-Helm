/// ============================================================================
/// HR PROVIDER — Academia Hub Mobile
/// ============================================================================
///
/// Riverpod providers for the HR (Ressources Humaines) module.
/// Uses [HrService] for CRUD operations and returns [AsyncValue] states
/// that integrate seamlessly with [AsyncValueWidget] and [ModuleLoadingWrapper].
///
/// Providers:
/// - hrServiceProvider            → Singleton for [HrService]
/// - staffProvider                → List of staff members
/// - staffDetailProvider          → Family by id for single staff member
/// - contractsProvider            → List of contracts
/// - contractDetailProvider       → Family by id for single contract
/// - payrollProvider              → List of payroll records
/// - payrollDetailProvider        → Family by id for single payroll
/// - leavesProvider               → List of leaves
/// - credentialsProvider          → List of certifications
/// - HrMutationNotifier           → create/update/approve/reject mutations
///
/// Usage with ModuleLoadingWrapper:
/// ```dart
/// class StaffScreen extends ConsumerWidget {
///   @override
///   Widget build(BuildContext context, WidgetRef ref) {
///     final staffAsync = ref.watch(staffProvider);
///
///     return ModuleLoadingWrapper<List<Map<String, dynamic>>>(
///       value: staffAsync,
///       moduleName: 'Personnel',
///       onRetry: () => ref.invalidate(staffProvider),
///       builder: (staff) => StaffList(staff: staff),
///     );
///   }
/// }
/// ```
/// ============================================================================

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_result.dart';
import '../../../data/services/hr_service.dart';

// ─── Service Provider ────────────────────────────────────────────────────────

/// Singleton provider for [HrService].
final hrServiceProvider = Provider<HrService>((ref) {
  return HrService();
});

// ─── Staff List Provider ─────────────────────────────────────────────────────

/// Fetches the list of all staff members.
final staffProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final service = ref.read(hrServiceProvider);
  final result = await service.getStaff();

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => [],
  );
});

// ─── Staff Detail Provider ───────────────────────────────────────────────────

/// Fetches a single staff member by ID.
///
/// Usage:
/// ```dart
/// final staffAsync = ref.watch(staffDetailProvider(staffId));
/// ```
final staffDetailProvider =
    FutureProvider.family<Map<String, dynamic>, String>((ref, id) async {
  final service = ref.read(hrServiceProvider);
  final result = await service.getStaffById(id);

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => <String, dynamic>{},
  );
});

// ─── Contracts Provider ──────────────────────────────────────────────────────

/// Fetches the list of contracts.
final contractsProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final service = ref.read(hrServiceProvider);
  final result = await service.getContracts();

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => [],
  );
});

// ─── Contract Detail Provider ────────────────────────────────────────────────

/// Fetches a single contract by ID.
///
/// Usage:
/// ```dart
/// final contractAsync = ref.watch(contractDetailProvider(contractId));
/// ```
final contractDetailProvider =
    FutureProvider.family<Map<String, dynamic>, String>((ref, id) async {
  final service = ref.read(hrServiceProvider);
  final result = await service.getContractById(id);

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => <String, dynamic>{},
  );
});

// ─── Payroll Provider ────────────────────────────────────────────────────────

/// Fetches the list of payroll records.
final payrollProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final service = ref.read(hrServiceProvider);
  final result = await service.getPayroll();

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => [],
  );
});

// ─── Payroll Detail Provider ─────────────────────────────────────────────────

/// Fetches a single payroll record by ID.
///
/// Usage:
/// ```dart
/// final payrollAsync = ref.watch(payrollDetailProvider(payrollId));
/// ```
final payrollDetailProvider =
    FutureProvider.family<Map<String, dynamic>, String>((ref, id) async {
  final service = ref.read(hrServiceProvider);
  final result = await service.getPayrollById(id);

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => <String, dynamic>{},
  );
});

// ─── Leaves Provider ─────────────────────────────────────────────────────────

/// Fetches the list of leaves.
final leavesProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final service = ref.read(hrServiceProvider);
  final result = await service.getLeaves();

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => [],
  );
});

// ─── Credentials Provider ────────────────────────────────────────────────────

/// Fetches the list of staff certifications/credentials.
final credentialsProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final service = ref.read(hrServiceProvider);
  final result = await service.getCredentials();

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => [],
  );
});

// ─── Mutation Notifier ───────────────────────────────────────────────────────

/// Notifier for HR CRUD mutations that automatically invalidates
/// relevant providers on success.
class HrMutationNotifier extends StateNotifier<AsyncValue<void>> {
  final Ref _ref;
  final HrService _service;

  HrMutationNotifier(this._ref, this._service)
      : super(const AsyncValue.data(null));

  /// Creates a staff member and refreshes the list.
  Future<bool> createStaff(Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.createStaff(data);
      return result.when(
        success: (_) {
          _ref.invalidate(staffProvider);
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

  /// Updates a staff member and refreshes the list.
  Future<bool> updateStaff(String id, Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.updateStaff(id, data);
      return result.when(
        success: (_) {
          _ref.invalidate(staffProvider);
          _ref.invalidate(staffDetailProvider(id));
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

  /// Creates a contract and refreshes the list.
  Future<bool> createContract(Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.createContract(data);
      return result.when(
        success: (_) {
          _ref.invalidate(contractsProvider);
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

  /// Updates a contract and refreshes the list.
  Future<bool> updateContract(String id, Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.updateContract(id, data);
      return result.when(
        success: (_) {
          _ref.invalidate(contractsProvider);
          _ref.invalidate(contractDetailProvider(id));
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

  /// Records a leave and refreshes the list.
  Future<bool> recordLeave(Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.recordLeave(data);
      return result.when(
        success: (_) {
          _ref.invalidate(leavesProvider);
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

  /// Approves a leave and refreshes the list.
  Future<bool> approveLeave(String id) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.approveLeave(id);
      return result.when(
        success: (_) {
          _ref.invalidate(leavesProvider);
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

  /// Rejects a leave and refreshes the list.
  Future<bool> rejectLeave(String id, String comment) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.rejectLeave(id, comment);
      return result.when(
        success: (_) {
          _ref.invalidate(leavesProvider);
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

/// Provider for HR mutation operations.
final hrMutationProvider =
    StateNotifierProvider<HrMutationNotifier, AsyncValue<void>>((ref) {
  final service = ref.read(hrServiceProvider);
  return HrMutationNotifier(ref, service);
});
