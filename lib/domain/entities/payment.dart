import 'package:freezed_annotation/freezed_annotation.dart';

part 'payment.freezed.dart';
part 'payment.g.dart';

/// Represents a payment/invoice for a student.
@freezed
class Payment with _$Payment {
  const factory Payment({
    required String id,
    required String studentId,
    required String label,
    required double amount,
    required double paidAmount,
    required PaymentStatus status,
    DateTime? dueDate,
    DateTime? paidAt,
    String? paymentMethod, // 'CASH', 'MOBILE_MONEY', 'BANK_TRANSFER', 'CARD'
    String? transactionRef,
    String? receiptUrl,
    String? invoiceUrl,
    DateTime? createdAt,
  }) = _Payment;

  const Payment._();

  /// Remaining amount to pay.
  double get remainingAmount => amount - paidAmount;

  /// Whether the payment is fully paid.
  bool get isFullyPaid => status == PaymentStatus.paid;

  /// Whether the payment is overdue.
  bool get isOverdue => status == PaymentStatus.overdue ||
      (status == PaymentStatus.pending &&
          dueDate != null &&
          dueDate!.isBefore(DateTime.now()));

  /// Payment progress (0.0 to 1.0).
  double get progress => amount > 0 ? paidAmount / amount : 0;

  /// Display amount with currency.
  String get displayAmount => '${amount.toStringAsFixed(0)} FCFA';
  String get displayPaidAmount => '${paidAmount.toStringAsFixed(0)} FCFA';
  String get displayRemainingAmount =>
      '${remainingAmount.toStringAsFixed(0)} FCFA';

  factory Payment.fromJson(Map<String, dynamic> json) =>
      _$PaymentFromJson(json);
}

/// Payment status enum.
enum PaymentStatus {
  @JsonValue('PENDING')
  pending,
  @JsonValue('PARTIAL')
  partial,
  @JsonValue('PAID')
  paid,
  @JsonValue('OVERDUE')
  overdue,
  @JsonValue('CANCELLED')
  cancelled,
}
