import 'package:freezed_annotation/freezed_annotation.dart';
import '../../domain/entities/payment.dart';

part 'payment_dto.g.dart';

/// DTO for [Payment] with snake_case field names matching the API response.
@JsonSerializable(fieldRename: FieldRename.snake)
class PaymentDto {
  final String id;
  final String studentId;
  final String label;
  final double amount;
  final double paidAmount;
  final String status; // API returns string, convert to enum
  final String? dueDate;
  final String? paidAt;
  final String? paymentMethod;
  final String? transactionRef;
  final String? receiptUrl;
  final String? invoiceUrl;
  final String? createdAt;

  PaymentDto({
    required this.id,
    required this.studentId,
    required this.label,
    required this.amount,
    required this.paidAmount,
    required this.status,
    this.dueDate,
    this.paidAt,
    this.paymentMethod,
    this.transactionRef,
    this.receiptUrl,
    this.invoiceUrl,
    this.createdAt,
  });

  factory PaymentDto.fromJson(Map<String, dynamic> json) =>
      _$PaymentDtoFromJson(json);

  Map<String, dynamic> toJson() => _$PaymentDtoToJson(this);

  /// Converts the API status string to [PaymentStatus] enum.
  PaymentStatus _parseStatus(String statusStr) {
    switch (statusStr.toUpperCase()) {
      case 'PENDING':
        return PaymentStatus.pending;
      case 'PARTIAL':
        return PaymentStatus.partial;
      case 'PAID':
        return PaymentStatus.paid;
      case 'OVERDUE':
        return PaymentStatus.overdue;
      case 'CANCELLED':
        return PaymentStatus.cancelled;
      default:
        return PaymentStatus.pending;
    }
  }

  Payment toDomain() => Payment(
        id: id,
        studentId: studentId,
        label: label,
        amount: amount,
        paidAmount: paidAmount,
        status: _parseStatus(status),
        dueDate: dueDate != null ? DateTime.tryParse(dueDate!) : null,
        paidAt: paidAt != null ? DateTime.tryParse(paidAt!) : null,
        paymentMethod: paymentMethod,
        transactionRef: transactionRef,
        receiptUrl: receiptUrl,
        invoiceUrl: invoiceUrl,
        createdAt: createdAt != null ? DateTime.tryParse(createdAt!) : null,
      );
}
