import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_config.dart';

// ── Models ────────────────────────────────────────────────────────────

/// Payment status enum.
enum PaymentStatus {
  pending('En attente', 'PENDING'),
  partial('Partiel', 'PARTIAL'),
  paid('Payé', 'PAID'),
  overdue('En retard', 'OVERDUE');

  const PaymentStatus(this.label, this.apiValue);
  final String label;
  final String apiValue;
}

/// A single payment/invoice entry.
class Payment {
  final String id;
  final String studentId;
  final String studentName;
  final String label;
  final double amount;
  final double paidAmount;
  final PaymentStatus status;
  final DateTime dueDate;
  final DateTime? paidDate;
  final String? paymentMethod;
  final String? transactionRef;
  final String? academicYearId;
  final String? academicYearName;
  final DateTime createdAt;

  const Payment({
    required this.id,
    required this.studentId,
    required this.studentName,
    required this.label,
    required this.amount,
    required this.paidAmount,
    required this.status,
    required this.dueDate,
    this.paidDate,
    this.paymentMethod,
    this.transactionRef,
    this.academicYearId,
    this.academicYearName,
    required this.createdAt,
  });

  /// Whether the payment is fully paid.
  bool get isPaid => status == PaymentStatus.paid;

  /// Whether the payment is overdue.
  bool get isOverdue => status == PaymentStatus.overdue;

  /// Whether the payment is pending.
  bool get isPending => status == PaymentStatus.pending;

  /// Whether the payment is partial.
  bool get isPartial => status == PaymentStatus.partial;

  /// Remaining amount to pay.
  double get remainingAmount => amount - paidAmount;

  /// Progress percentage (0–100).
  double get progressPercentage => amount > 0 ? (paidAmount / amount) * 100 : 0;

  factory Payment.fromJson(Map<String, dynamic> json) {
    return Payment(
      id: json['id'] as String? ?? '',
      studentId: json['studentId'] as String? ?? json['student_id'] as String? ?? '',
      studentName: json['studentName'] as String? ?? json['student_name'] as String? ?? '',
      label: json['label'] as String? ?? '',
      amount: (json['amount'] as num?)?.toDouble() ?? 0.0,
      paidAmount: (json['paidAmount'] as num?)?.toDouble() ?? (json['paid_amount'] as num?)?.toDouble() ?? 0.0,
      status: _parsePaymentStatus(json['status'] as String?),
      dueDate: json['dueDate'] != null
          ? DateTime.parse(json['dueDate'] as String)
          : json['due_date'] != null
              ? DateTime.parse(json['due_date'] as String)
              : DateTime.now(),
      paidDate: json['paidDate'] != null
          ? DateTime.parse(json['paidDate'] as String)
          : json['paid_date'] != null
              ? DateTime.parse(json['paid_date'] as String)
              : null,
      paymentMethod: json['paymentMethod'] as String? ?? json['payment_method'] as String?,
      transactionRef: json['transactionRef'] as String? ?? json['transaction_ref'] as String?,
      academicYearId: json['academicYearId'] as String? ?? json['academic_year_id'] as String?,
      academicYearName: json['academicYearName'] as String? ?? json['academic_year_name'] as String?,
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'] as String)
          : DateTime.now(),
    );
  }

  static PaymentStatus _parsePaymentStatus(String? value) {
    if (value == null) return PaymentStatus.pending;
    switch (value.toUpperCase()) {
      case 'PAID':
        return PaymentStatus.paid;
      case 'PARTIAL':
        return PaymentStatus.partial;
      case 'OVERDUE':
        return PaymentStatus.overdue;
      case 'PENDING':
      default:
        return PaymentStatus.pending;
    }
  }
}

/// Summary of pending payments.
class PaymentsSummary {
  final double totalPending;
  final double totalOverdue;
  final int pendingCount;
  final int overdueCount;
  final int paidCount;

  const PaymentsSummary({
    required this.totalPending,
    required this.totalOverdue,
    required this.pendingCount,
    required this.overdueCount,
    required this.paidCount,
  });
}

/// Filter for payment status.
enum PaymentFilter {
  all('Tous', null),
  pending('En attente', PaymentStatus.pending),
  paid('Payé', PaymentStatus.paid),
  overdue('En retard', PaymentStatus.overdue);

  const PaymentFilter(this.label, this.status);
  final String label;
  final PaymentStatus? status;
}

// ── Payments List Notifier ────────────────────────────────────────────

class PaymentsListNotifier extends FamilyAsyncNotifier<List<Payment>, PaymentFilter> {
  @override
  Future<List<Payment>> build(PaymentFilter arg) async {
    final apiClient = ref.read(apiClientProvider);
    final queryParams = <String, dynamic>{};
    if (arg.status != null) {
      queryParams['status'] = arg.status!.apiValue;
    }

    final result = await apiClient.get<List<Payment>>(
      '${ApiConfig.versionedBaseUrl}/payments',
      queryParameters: queryParams.isNotEmpty ? queryParams : null,
      fromJson: (json) {
        final data = json['data'] ?? json;
        if (data is List) {
          return data.map((e) => Payment.fromJson(e as Map<String, dynamic>)).toList();
        }
        return <Payment>[];
      },
    );

    return result.when(
      success: (payments) => payments,
      failure: (error) => throw Exception(error.displayMessage),
      loading: () => <Payment>[],
    );
  }

  /// Refresh the payments list.
  Future<void> refresh() async {
    state = const AsyncLoading();
    state = AsyncData(await build(arg));
  }
}

/// Provider for the payments list with status filter.
final paymentsListProvider = AsyncNotifierProvider.family<PaymentsListNotifier, List<Payment>, PaymentFilter>(
  PaymentsListNotifier.new,
);

// ── Payment Detail Notifier ───────────────────────────────────────────

class PaymentDetailNotifier extends FamilyAsyncNotifier<Payment, String> {
  @override
  Future<Payment> build(String arg) async {
    final apiClient = ref.read(apiClientProvider);
    final result = await apiClient.get<Payment>(
      '${ApiConfig.versionedBaseUrl}/payments/$arg',
      fromJson: (json) => Payment.fromJson(json),
    );

    return result.when(
      success: (payment) => payment,
      failure: (error) => throw Exception(error.displayMessage),
      loading: () => Payment(
        id: '',
        studentId: '',
        studentName: '',
        label: '',
        amount: 0,
        paidAmount: 0,
        status: PaymentStatus.pending,
        dueDate: DateTime.now(),
        createdAt: DateTime.now(),
      ),
    );
  }
}

/// Provider for a single payment detail.
final paymentDetailProvider = AsyncNotifierProvider.family<PaymentDetailNotifier, Payment, String>(
  PaymentDetailNotifier.new,
);

// ── Pending Payments Summary Provider ─────────────────────────────────

/// Provider that computes pending payments summary from the full list.
final pendingPaymentsSummaryProvider = FutureProvider<PaymentsSummary>((ref) async {
  final paymentsAsync = ref.watch(paymentsListProvider(PaymentFilter.all));
  return paymentsAsync.when(
    data: (payments) {
      double totalPending = 0;
      double totalOverdue = 0;
      int pendingCount = 0;
      int overdueCount = 0;
      int paidCount = 0;

      for (final payment in payments) {
        switch (payment.status) {
          case PaymentStatus.pending:
            totalPending += payment.remainingAmount;
            pendingCount++;
            break;
          case PaymentStatus.overdue:
            totalOverdue += payment.remainingAmount;
            overdueCount++;
            break;
          case PaymentStatus.paid:
            paidCount++;
            break;
          case PaymentStatus.partial:
            totalPending += payment.remainingAmount;
            pendingCount++;
            break;
        }
      }

      return PaymentsSummary(
        totalPending: totalPending,
        totalOverdue: totalOverdue,
        pendingCount: pendingCount,
        overdueCount: overdueCount,
        paidCount: paidCount,
      );
    },
    loading: () => const PaymentsSummary(
      totalPending: 0,
      totalOverdue: 0,
      pendingCount: 0,
      overdueCount: 0,
      paidCount: 0,
    ),
    error: (_, __) => const PaymentsSummary(
      totalPending: 0,
      totalOverdue: 0,
      pendingCount: 0,
      overdueCount: 0,
      paidCount: 0,
    ),
  );
});

/// Selected payment filter state.
final selectedPaymentFilterProvider = StateProvider<PaymentFilter>((ref) => PaymentFilter.all);

// ── Mock Data ─────────────────────────────────────────────────────────

List<Payment> getMockPayments(PaymentFilter filter) {
  final allPayments = [
    Payment(
      id: 'pay-001',
      studentId: 'student-001',
      studentName: 'Amadou Diallo',
      label: 'Frais de scolarité — Trimestre 2',
      amount: 150000,
      paidAmount: 150000,
      status: PaymentStatus.paid,
      dueDate: DateTime(2025, 1, 15),
      paidDate: DateTime(2025, 1, 10),
      paymentMethod: 'Mobile Money',
      transactionRef: 'MM-2025-001234',
      createdAt: DateTime(2024, 12, 1),
    ),
    Payment(
      id: 'pay-002',
      studentId: 'student-001',
      studentName: 'Amadou Diallo',
      label: 'Frais de scolarité — Trimestre 3',
      amount: 150000,
      paidAmount: 75000,
      status: PaymentStatus.partial,
      dueDate: DateTime(2025, 3, 15),
      paymentMethod: 'Virement bancaire',
      transactionRef: 'VB-2025-005678',
      createdAt: DateTime(2025, 2, 1),
    ),
    Payment(
      id: 'pay-003',
      studentId: 'student-001',
      studentName: 'Amadou Diallo',
      label: 'Frais d\'inscription',
      amount: 50000,
      paidAmount: 0,
      status: PaymentStatus.pending,
      dueDate: DateTime(2025, 4, 1),
      createdAt: DateTime(2025, 1, 15),
    ),
    Payment(
      id: 'pay-004',
      studentId: 'student-001',
      studentName: 'Amadou Diallo',
      label: 'Carnet de notes',
      amount: 5000,
      paidAmount: 0,
      status: PaymentStatus.overdue,
      dueDate: DateTime(2025, 1, 30),
      createdAt: DateTime(2024, 12, 10),
    ),
    Payment(
      id: 'pay-005',
      studentId: 'student-001',
      studentName: 'Amadou Diallo',
      label: 'Frais de scolarité — Trimestre 1',
      amount: 150000,
      paidAmount: 150000,
      status: PaymentStatus.paid,
      dueDate: DateTime(2024, 10, 15),
      paidDate: DateTime(2024, 10, 5),
      paymentMethod: 'Espèces',
      transactionRef: 'ESP-2024-009876',
      createdAt: DateTime(2024, 9, 1),
    ),
    Payment(
      id: 'pay-006',
      studentId: 'student-001',
      studentName: 'Amadou Diallo',
      label: 'Sortie pédagogique',
      amount: 15000,
      paidAmount: 15000,
      status: PaymentStatus.paid,
      dueDate: DateTime(2025, 2, 20),
      paidDate: DateTime(2025, 2, 18),
      paymentMethod: 'Mobile Money',
      transactionRef: 'MM-2025-003456',
      createdAt: DateTime(2025, 2, 1),
    ),
  ];

  if (filter.status == null) return allPayments;
  return allPayments.where((p) => p.status == filter.status).toList();
}
